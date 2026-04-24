import { User } from "../modules/users/user.model";

export const generateReferralCode = async (): Promise<string> => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code: string;
  let exists = true;

  do {
    code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    exists = !!(await User.exists({ referralCode: code }));
  } while (exists);

  return code;
};
