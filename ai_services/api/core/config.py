"""
Config loader for WoundCare-AI pipeline.

Reads config.yaml and returns a dot-accessible Config object.

Usage:
    from api.core.config import load_config
    cfg = load_config()                  # loads config.yaml in cwd
    cfg = load_config("my.yaml")         # load alternate config for experiments

    cfg.paths.processed_data_dir
    cfg.training.epochs
    cfg.image_quality.min_sharpness
"""

from pathlib import Path
from types import SimpleNamespace

import yaml


def _to_namespace(obj):
    """Recursively convert dicts to SimpleNamespace for dot-access."""
    if isinstance(obj, dict):
        return SimpleNamespace(**{k: _to_namespace(v) for k, v in obj.items()})
    if isinstance(obj, list):
        return [_to_namespace(item) for item in obj]
    return obj


def load_config(path: str = "config.yaml") -> SimpleNamespace:
    """
    Load pipeline config from a YAML file.

    Args:
        path: Path to the YAML config file. Defaults to 'config.yaml' in the
              current working directory.

    Returns:
        SimpleNamespace with dot-access to all config values.

    Raises:
        FileNotFoundError: If the config file does not exist.
    """
    config_path = Path(path)
    if not config_path.exists():
        raise FileNotFoundError(
            f"Config file not found: {config_path.resolve()}\n"
            "Make sure you are running from the project root directory, "
            "or pass the path explicitly: load_config('path/to/config.yaml')"
        )

    with open(config_path, "r") as f:
        data = yaml.safe_load(f)

    return _to_namespace(data)
