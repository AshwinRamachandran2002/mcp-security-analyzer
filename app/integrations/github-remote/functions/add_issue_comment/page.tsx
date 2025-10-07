import { redirect } from "next/navigation";

export default function AddIssueCommentPage() {
  // Redirect to the dynamic arguments page
  redirect("/servers/github-remote/functions/add_issue_comment/arguments");
}
