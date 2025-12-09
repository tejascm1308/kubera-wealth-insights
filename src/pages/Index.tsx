import { Navigate } from 'react-router-dom';

// Redirect index to landing page
const Index = () => {
  return <Navigate to="/" replace />;
};

export default Index;
