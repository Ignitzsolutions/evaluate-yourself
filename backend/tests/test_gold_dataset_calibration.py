from pathlib import Path

from tests.evals.run_report_calibration import run_calibration_dataset


def test_synthetic_gold_dataset_calibration_runner_passes_bootstrap_cases():
    dataset_path = Path(__file__).resolve().parents[2] / "tests" / "evals" / "golden_interview_dataset.json"
    result = run_calibration_dataset(dataset_path)

    assert result["case_count"] == 3
    assert result["failed_count"] == 0
