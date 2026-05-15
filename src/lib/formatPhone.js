export function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');

  // Número brasileiro com DDI 55
  if (digits.startsWith('55') && digits.length >= 12) {
    const local = digits.slice(2); // remove 55
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    if (rest.length === 9) {
      // Celular: 9 dígitos
      return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      // Fixo: 8 dígitos
      return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }

  // Número local sem DDI (10 ou 11 dígitos)
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  return raw;
}
