module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4.x worklet desteği – son sırada olmalı
      'react-native-worklets/plugin',
    ],
  };
};
