import { execSync } from "child_process";
import { temporaryWriteTask } from "tempy";

export async function getCompiledQuery(
  queryText: string,
  compilerRoot: string
): Promise<string> {
  return await temporaryWriteTask(queryText, (fileName: string) => {
    try {
      const t = execSync(`cpp -P -I. ${fileName}`, { cwd: compilerRoot });
      console.log(t.toString());
      return t.toString();
    } catch (error) {
      console.error(error);
      return queryText;
    }
  });
}
