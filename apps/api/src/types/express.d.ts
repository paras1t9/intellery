import { AuthenticatedUser } from "./auth.ts";

declare global{
  namespace express{
    interface Request{
      user : AuthenticatedUser;
    }
  }
}