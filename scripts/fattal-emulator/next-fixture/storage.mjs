export async function uploadStoredObject({ key, body, maxAttempts }) {
  if (maxAttempts !== 1) throw Error('Cloud must request one storage attempt');
  const response = await fetch(`${process.env.FATTAL_TEST_OBJECT_ORIGIN}/objects/${key}`, {
    method: 'PUT', body, redirect: 'error',
  });
  if (response.status !== 201) throw Error('Fixture object write failed');
  return { url: `https://fattal-objects.invalid/objects/${key}`, size: body.length,
    storageProvider: 'cloudflare-r2', storageKey: key, storageBucket: 'synthetic-disk-bucket' };
}
