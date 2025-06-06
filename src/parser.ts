export interface InputParam {
    key: string;
    type: string;
    optional: boolean;
}

export function parseGeneratedInputParams(tsContent: string): InputParam[] {
    const lines = tsContent.split("\n");
    const params: InputParam[] = [];

    let insideInterface = false;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (insideInterface) {
            // Check for the end of the interface
            if (trimmedLine === "}") {
                insideInterface = false;
                break; // Exit the loop when we reach the end of the interface
            }

            // Match lines that define properties in the interface
            const match = trimmedLine.match(/^\s*(\w+)(\?)?:\s*([\w|]+);/);
            if (match) {
                const [, key, optional, type] = match;
                params.push({
                    key,
                    type: type,
                    optional: !!optional,
                });
            }
            continue;
        }
        if (trimmedLine.startsWith("export interface Input {") || trimmedLine.startsWith("export type Input = {")) {
            insideInterface = true;
            continue; // Skip the interface declaration line
        }
    }

    return params;
}