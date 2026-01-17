import { setGlobalOptions } from "firebase-functions/v2";
export { getConsistencyScore } from "./userScoreFunction";

setGlobalOptions({ maxInstances: 10 });
