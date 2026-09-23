(async () => {
  const params = new URLSearchParams(window.location.search);
  const booking = params.get("booking");
  const token = params.get("token");
  const result = document.getElementById("result");

  if (!booking || !token) {
    result.innerHTML = '<div class="notice is-error">This cancellation link is missing information — use the link from your confirmation email.</div>';
    return;
  }

  const res = await Api.cancelBooking(booking, token);

  if (res.success) {
    result.innerHTML = `
      <h2>Booking cancelled</h2>
      <p>Your desk booking has been cancelled and the desk is free for others to book.</p>
      <a class="btn btn-primary" href="index.html">Book another desk</a>`;
  } else {
    result.innerHTML = '<div class="notice is-error">This link has already been used, or the booking couldn\'t be found.</div>';
  }
})();
