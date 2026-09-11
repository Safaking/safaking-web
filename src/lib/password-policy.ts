/**
 * Password rules. Staff accounts get the strong rule the owner asked for;
 * customers keep the simple one, since a lost sale costs more there than a
 * weak password does.
 */

export const STAFF_PASSWORD_RULES = [
  'At least 10 characters',
  'Upper-case and lower-case letters',
  'At least one number',
  'Not your name, your email or a common password',
];

const COMMON = [
  'password', 'passw0rd', 'safaking', 'safa', 'admin', 'admin123', 'welcome', 'letmein',
  'qwerty', '123456', '12345678', '123456789', 'india123', 'jaipur', 'jodhpur',
];

export function passwordProblems(
  password: string,
  opts: { strong: boolean; email?: string | null; name?: string | null }
): string[] {
  if (!opts.strong) {
    return password.length < 6 ? ['Password must be at least 6 characters.'] : [];
  }

  const problems: string[] = [];
  const lower = password.toLowerCase();
  if (password.length < 10) problems.push('Use at least 10 characters.');
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) problems.push('Mix upper-case and lower-case letters.');
  if (!/\d/.test(password)) problems.push('Include at least one number.');

  const personal = [
    opts.email?.split('@')[0],
    ...(opts.name ?? '').split(/\s+/),
  ].filter((part): part is string => !!part && part.length >= 3);
  if (personal.some((part) => lower.includes(part.toLowerCase()))) {
    problems.push('Do not use your name or email in the password.');
  }
  if (COMMON.some((word) => lower.includes(word))) {
    problems.push('That contains a common password — choose something less guessable.');
  }
  return problems;
}
