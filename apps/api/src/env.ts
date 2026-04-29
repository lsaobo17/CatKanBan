export const env = {
  API_HOST: process.env.API_HOST ?? "0.0.0.0",
  API_PORT: Number(process.env.API_PORT ?? 3000),
  ADMIN_USERNAME: process.env.ADMIN_USERNAME ?? "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin12345",
  ADMIN_NAME: process.env.ADMIN_NAME ?? "CatKanBan Admin"
};
