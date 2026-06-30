export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }

  const { closeRedis } = await import('@/lib/redis/shutdown');

  const handleShutdown = () => {
    void closeRedis();
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}
