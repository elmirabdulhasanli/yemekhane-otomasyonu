// Container saat dilimi TZ=Europe/Istanbul; bugünün tarihi YYYY-MM-DD.
function bugun() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
module.exports = { bugun };
