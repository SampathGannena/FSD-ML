import pandas as pd
import numpy as np
import pickle
# import joblib
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# Load the dataset
df = pd.read_csv("cleaned_augmented_study_groups_final.csv")

# Drop irrelevant columns
df = df.drop(columns=["user_id"], errors="ignore")

# Encode categorical features
encoders = {}
for col in ["subject", "schedule", "difficulty", "habit"]:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col])
    encoders[col] = le

# Encode target column
group_encoder = LabelEncoder()
df["GroupName"] = group_encoder.fit_transform(df["GroupName"])
encoders["GroupName"] = group_encoder

# Split features and target
X = df.drop(columns=["GroupName"])
y = df["GroupName"]

# ➤ 🧪 EVALUATE MODEL PERFORMANCE BEFORE SAVING
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = GradientBoostingClassifier()
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred, labels=np.unique(y_test), target_names=group_encoder.inverse_transform(np.unique(y_test))))

# ➤ Save encoders and model after evaluating
# encoder = OneHotEncoder(handle_unknown='ignore')
# encoder.fit(X)

with open("gb_model.pkl", "wb") as f:
    pickle.dump(model, f)

with open("label_encoders.pkl", "wb") as f:
    pickle.dump(encoders, f)

# joblib.dump(encoder, "encoder.pkl")

print("✅ Model trained, evaluated, and saved!")
