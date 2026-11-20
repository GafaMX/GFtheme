/** Version que viaja en heartbeats. El embed la pisa con el tag de publish si Vite la define. */
export const SDK_VERSION =
  typeof __GAFA_SDK_VERSION__ !== "undefined" ? __GAFA_SDK_VERSION__ : "0.1.0";
