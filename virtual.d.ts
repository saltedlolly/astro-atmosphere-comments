declare module "virtual:atmosphere-comments/settings" {
  const settings: import("./lib/settings").AtmosphereSettings;
  export default settings;
}

declare module "virtual:atmosphere-comments/public-settings" {
  const settings: import("./lib/public-settings").PublicSettings;
  export default settings;
}
