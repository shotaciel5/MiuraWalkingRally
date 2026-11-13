"""Verification-only oracle. Runtime app never launches Python."""
import csv,json,sys
from pathlib import Path
from scipy.optimize import linear_sum_assignment
ROOT=Path(__file__).resolve().parents[1]
REF=ROOT/'tools/koma-omission-reference'
sys.path[:0]=[str(REF/'runtime'),str(REF/'source/scripts')]
from predict import forest_score,decide
import junction_experiment_features as features
incoming=json.load(sys.stdin)
rows=json.loads((REF/'data/prepared-original-697.json').read_text(encoding='utf-8'))['rows']
model=json.loads((REF/'models/corrected-candidate/model.json').read_text(encoding='utf-8'))
with (REF/'experiments/original-697/predictions.csv').open(encoding='utf-8-sig',newline='') as f:
    predictions={r['key']:r for r in csv.DictReader(f)}
folds={i:json.loads((REF/f'experiments/original-697/fold-{i}/model-D.json').read_text(encoding='utf-8')) for i in range(1,6)}
results=[]
for row,prepared in zip(rows,incoming['prepared']):
    vector=features.vectors(row)['D']
    prediction=predictions[row['key']]
    assert abs(forest_score(folds[int(prediction['fold'])],vector)-float(prediction['scoreD']))<=1e-12
    operational=None if prepared.get('error') else features.vectors(prepared['row'])['D']
    results.append(dict(features=vector,operationalFeatures=operational,currentScore=forest_score(model,vector),legacyScore=forest_score(folds[int(prediction['fold'])],vector),operational=decide(prepared,model)))
assignments=[[[int(i),int(j)] for i,j in zip(*linear_sum_assignment(matrix))] for matrix in incoming['matrices']]
json.dump(dict(rows=results,assignments=assignments),sys.stdout,separators=(',',':'))
