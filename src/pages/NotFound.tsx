import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("404: rota inexistente, redirecionando para /rifa:", location.pathname);
  }, [location.pathname]);

  return <Navigate to="/rifa" replace />;
};

export default NotFound;
