from flask import Flask, request, jsonify
from transformers import GPT2LMHeadModel, GPT2Tokenizer
from flask_cors import CORS
import torch

app = Flask(__name__)
CORS(app)

# Load your trained model and tokenizer from the "trained_model" directory
model = GPT2LMHeadModel.from_pretrained("trained_model")
tokenizer = GPT2Tokenizer.from_pretrained("trained_model")
model.eval()  # Set the model to evaluation mode

@app.route('/chat', methods=['POST'])
def chat():
    # Get the JSON payload from the request
    data = request.get_json()
    message = data.get('message', '')
    
    if not message:
        return jsonify({'response': "Please provide a valid message."}), 400

    # Encode the incoming message
    input_ids = tokenizer.encode(message, return_tensors="pt")
    
    # Generate a response from the model
    with torch.no_grad():
        output = model.generate(
            input_ids,
            max_length=150,       # Adjust max_length as needed
            do_sample=True,
            temperature=0.7       # Lower temperature -> less random answers
        )
    response_text = tokenizer.decode(output[0], skip_special_tokens=True)
    return jsonify({'response': response_text})

if __name__ == '__main__':
    # Run the Flask app on port 5000
    app.run(host="0.0.0.0", port=7000)
