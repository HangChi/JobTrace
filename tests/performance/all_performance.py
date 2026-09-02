from application_performance import main as application_main
from interview_performance import main as interview_main
import subprocess


if __name__ == "__main__":
    application_main()
    interview_main()
    subprocess.run(
        ["node", "tests/performance/admin-console-performance.ts"], check=True
    )
    subprocess.run(
        ["node", "tests/performance/job-market-performance.ts"], check=True
    )
