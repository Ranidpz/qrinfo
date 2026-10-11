export function isR2Url(value) {
  return new URL(value).origin === 'https://fattal-objects.invalid';
}
