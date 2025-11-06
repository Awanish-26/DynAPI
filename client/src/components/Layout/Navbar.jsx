import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {

    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="bg-gray-800 text-white py-4 px-8 flex justify-between items-center">
            <h1 className="text-xl font-bold">
                <Link to="/">DynAPI</Link>
            </h1>

            {isAuthenticated ? (
                <li className="flex">
                    <button
                        onClick={handleLogout}
                        className="hover:text-red-400 bg-gray-100/20 px-2 py-1 rounded-sm">
                        Logout
                    </button>
                </li>

            ) : (
                <div className="flex">
                    <Link to="/login" className="hover:text-red-400 bg-gray-100/20 px-2 py-1 rounded-sm">
                        Login
                    </Link>
                    <Link to="/register" className="ml-4 hover:text-green-400 bg-gray-100/20 px-2 py-1 rounded-sm">
                        Register
                    </Link>
                </div>
            )
            }
        </nav >
    );
};

export default Navbar;
