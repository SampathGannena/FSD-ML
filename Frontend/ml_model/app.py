from flask import Flask, request, jsonify
from flask_cors import CORS  # ← Add this line
from group_name_map import group_name_map
import pickle
import numpy as np
import pandas as pd
# import joblib


app = Flask(__name__)
CORS(app)  # ← Enable CORS for all routes

# Load model and encoders
with open("gb_model.pkl", "rb") as f:
    model = pickle.load(f)

with open("label_encoders.pkl", "rb") as f:
    encoders = pickle.load(f)

# encoder = joblib.load("encoder.pkl")

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        print("📨 Received data:", data)

        # Extract and format inputs
        subject = data.get("subject", "").lower()
        schedule = data.get("schedule", "").lower()
        difficulty = data.get("difficulty", "").lower()
        habit = data.get("habit", "")

        # Create input DataFrame
        input_df = pd.DataFrame([{
            "subject": subject,
            "schedule": schedule,
            "difficulty": difficulty,
            "habit": habit
        }])

        # Apply label encoders to each feature column
        for col in ["subject", "schedule", "difficulty", "habit"]:
            le = encoders.get(col)
            if le:
                input_df[col] = le.transform(input_df[col])

        # Predict group
        predicted_group = model.predict(input_df)[0]

        # Map prediction to group name
        group_name = group_name_map.get(predicted_group, "Unknown Group")

        return jsonify({
            "predicted_group": int(predicted_group),
            "group_name": group_name
        })

    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        return jsonify({"error": str(e)}), 400




if __name__ == "__main__":
    app.run(debug=True)









