const logActivity = require('../utils/activityLogger');

const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            // Log Activity
            await logActivity(
                user._id,
                'USER_LOGIN',
                `User logged in: ${user.name}`,
                req
            );

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: error.message || 'Server Error' });
    }
};

// @desc    Register a new user (by super admin)
// @route   POST /api/users
// @access  Private/SuperAdmin
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    const emailExists = await User.findOne({ email });
    if (emailExists) {
        return res.status(400).json({ message: 'Email is already registered' });
    }

    const nameExists = await User.findOne({ name });
    if (nameExists) {
        return res.status(400).json({ message: 'Name is already taken' });
    }

    const user = await User.create({
        name,
        email,
        password,
        role: 'admin' // Managed by super admin
    });

    if (user) {
        // Log activity
        await logActivity(
            req.user._id,
            'CREATED_ADMIN',
            `Created admin user: ${user.name} (${user.email})`,
            req
        );

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin
const getUsers = async (req, res) => {
    const users = await User.find({}).select('-password');
    res.json(users);
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
const deleteUser = async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        if (user.role === 'super_admin') {
            res.status(400);
            throw new Error('Super Admin cannot be deleted');
        }
        await User.findByIdAndDelete(req.params.id);

        // Log activity
        await logActivity(
            req.user._id,
            'DELETED_USER',
            `Deleted user: ${user.name} (${user.email})`,
            req
        );

        res.json({ message: 'User removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        if (req.body.name && req.body.name !== user.name) {
            const nameExists = await User.findOne({ name: req.body.name });
            if (nameExists) {
                return res.status(400).json({ message: 'Name is already taken' });
            }
            user.name = req.body.name;
        }

        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        // Log Activity
        await logActivity(
            user._id,
            'UPDATED_PROFILE',
            `User updated their profile: ${user.name}`,
            req
        );

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            token: generateToken(updatedUser._id),
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

module.exports = { authUser, registerUser, getUsers, deleteUser, updateUserProfile };
