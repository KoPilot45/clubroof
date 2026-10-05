const LOCAL_DEFAULT = 'postgres://clubroof:clubroof@localhost:5432/clubroof';

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? LOCAL_DEFAULT;
}
