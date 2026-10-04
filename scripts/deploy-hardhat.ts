// Both entry points share the same validated deployment recipe.
import deployment from './deploy-hardhat.cjs';
deployment.main().catch((error: unknown) => {
  console.error('Hardhat deployment error:', error);
  process.exitCode = 1;
});
