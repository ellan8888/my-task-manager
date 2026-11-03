// app/components/RoleBadge.tsx — label peran anggota tim (bukan "joki")
//   ellan → Owner, selain itu → Staff

export const OWNER_USERNAMES = ["ellan"];

export type TeamRole = "Owner" | "Staff";

export function roleOf(username?: string | null): TeamRole {
  return OWNER_USERNAMES.includes((username || "").toLowerCase()) ? "Owner" : "Staff";
}

export default function RoleBadge({ username, className = "" }: { username?: string | null; className?: string }) {
  const role = roleOf(username);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold normal-case tracking-normal align-middle ${
        role === "Owner"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      } ${className}`}
    >
      <i className={`fa-solid ${role === "Owner" ? "fa-crown" : "fa-user"} text-[8px]`}></i>
      {role}
    </span>
  );
}
