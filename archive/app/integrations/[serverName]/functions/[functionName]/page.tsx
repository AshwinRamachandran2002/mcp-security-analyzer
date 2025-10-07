import { redirect } from "next/navigation";

interface FunctionPageProps {
  params: {
    serverName: string;
    functionName: string;
  };
}

export default function FunctionPage({ params }: FunctionPageProps) {
  const { serverName, functionName } = params;
  
  // Redirect to the arguments page
  redirect(`/servers/${serverName}/functions/${functionName}/arguments`);
}
