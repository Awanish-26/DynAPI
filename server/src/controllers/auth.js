const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma/client');

const register = async (req, res) => {
    const { role, password } = req.body;

    if (!password || !role) {
        return res.status(400).json({ message: 'Password and role are required' });
    }

    try {
        const existingUser = await prisma.user.findFirst({ where: { role } });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this role already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                password: hashedPassword,
                role,
            },
        });

        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const login = async (req, res) => {
    const { role, password } = req.body;

    if (!role || !password) {
        return res.status(400).json({ message: 'Role and password are required' });
    }

    try {
        const user = await prisma.user.findFirst({ where: { role } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    register,
    login,
};