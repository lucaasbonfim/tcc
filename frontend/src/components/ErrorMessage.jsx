function ErrorMessage({ children }) {
  if (!children) {
    return null;
  }

  return (
    <div role="alert" className="error-message">
      {children}
    </div>
  );
}

export default ErrorMessage;
