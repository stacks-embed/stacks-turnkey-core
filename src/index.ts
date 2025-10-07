import Base from "./base";

import Auth from "./auth";
import Transactions from "./transactions";
import { applyMixins } from "./utils";

class StacksTurnkey extends Base {}
interface StacksTurnkey extends Auth, Transactions {}

applyMixins(StacksTurnkey, [Auth, Transactions]);

export default StacksTurnkey;
