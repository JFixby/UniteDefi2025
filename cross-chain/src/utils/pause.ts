import * as readline from 'readline';

/**
 * Pauses execution and waits for user input
 * @param message - Optional message to display before waiting
 * @returns Promise that resolves when user presses Enter
 */
export function pause(message: string = 'Press Enter to continue...'): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Pauses execution and waits for user confirmation
 * @param message - Message to display asking for confirmation
 * @returns Promise that resolves to true if user confirms, false otherwise
 */
export function confirm(message: string = 'Continue? (y/n): '): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(message, (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
} 