import * as bindings from '@stream-io/video-react-bindings';
import * as sdk from '@stream-io/video-react-sdk';

console.log("Bindings keys:", Object.keys(bindings));
console.log("SDK keys:", Object.keys(sdk));

try {
  const hooks = sdk.useCallStateHooks();
  console.log("Hooks keys:", Object.keys(hooks));
} catch (e) {
  console.log("Failed to call useCallStateHooks without provider:", e.message);
}
