import "server-only";

export {
  getIdentityBridgeActor,
  type IdentityBridgeActor,
} from "./infrastructure/identity-bridge-actor.server";
export { issueIdentityBridgeAssertion } from "./infrastructure/identity-bridge.server";
