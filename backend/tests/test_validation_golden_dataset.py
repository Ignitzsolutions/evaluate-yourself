from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.run_validation_golden_dataset import _load_dataset, evaluate_dataset_case, validate_dataset_case


def test_validation_golden_dataset_expectations_hold():
    failures = []
    for case in _load_dataset():
        result = evaluate_dataset_case(case)
        failures.extend([f"{case['id']}: {msg}" for msg in validate_dataset_case(result)])
    assert failures == []
