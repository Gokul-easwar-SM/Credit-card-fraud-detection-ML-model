# Kaggle ULB Benchmark (Offline Evaluation)

## 1. Purpose and Architectural Boundary

The **ULB Credit Card Fraud dataset** (Kaggle: `mlg-ulb/creditcardfraud`) contains **284,807 European credit card transactions** from September 2013 with **492 fraud cases** (fraud prevalence: ~0.172%).

> [!IMPORTANT]
> **Strict Architectural Separation**:
> - The Kaggle dataset features are 28 anonymised principal components (`V1` to `V28`) obtained via PCA, plus `Time` (seconds from initial transaction) and `Amount`.
> - It contains **no customer IDs, no device identifiers, no transaction channels (POS/Online/ATM), and no geographic coordinates**.
> - Therefore, **it is NEVER used by the live application or FastAPI scoring pipeline**.
> - It serves exclusively as an **offline ML benchmark** to establish historical baseline metrics against academic literature.

---

## 2. Benchmark Pipeline (`ml_training/kaggle_benchmark.py`)

1. **Deduplication**:
   - The raw Kaggle dataset contains **1,081 exact duplicate records** (identified in academic literature).
   - Our pipeline automatically removes duplicates prior to training, leaving **283,726 unique transactions** with **473 fraud cases** (0.1667% fraud prevalence).
2. **Stratification**:
   - 80% train (226,980 transactions) and 20% test (56,746 transactions) with stratification on the target `Class`.
3. **Scaling**:
   - `StandardScaler` applied to `Time` and `Amount` (fitted strictly on training split).
   - `V1`..`V28` are left unscaled because PCA components are already zero-centered with standard variance.
4. **Models Evaluated**:
   - **Logistic Regression** (balanced baseline)
   - **Random Forest** (balanced, 100 trees, max depth 12)
   - **LightGBM Champion** (balanced, 200 trees, learning rate 0.03, max depth 6)

---

## 3. Running the Benchmark

To execute the offline Kaggle benchmark:
```bash
python -m ml_training.kaggle_benchmark --data-dir data/kaggle --results-dir ml_training/results
```
Results and metrics are saved to [`ml_training/results/kaggle_metrics.json`](file:///c:/Users/THANGA%20ANGEL%20M/Desktop/Credit-Card-Fraud-Detection/fraud-system/ml_training/results/kaggle_metrics.json).
