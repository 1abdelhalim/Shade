window.addEventListener('error', (event) => {
  console.error("Global Error caught inside error-handler:", event.error ? event.error.message : event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error("Unhandled Rejection inside error-handler:", event.reason);
});
