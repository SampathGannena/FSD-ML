document.getElementById("study-form").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const subject = document.getElementById("subjects").value;
    const schedule = document.querySelector("input[name='schedule']:checked").value;
    const difficulty = document.getElementById("difficulty").value;
    const habit = document.getElementById("habit").value;
  
    const resultDiv = document.getElementById("result");
  
    try {
      const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          schedule,
          difficulty,
          habit,
        }),
      });
  
      const result = await response.json();
  
      if (response.ok) {
        const groupName = result.group_name;
        const token = localStorage.getItem('token');
        resultDiv.innerHTML = `✅ You're matched with: <strong>Group ${groupName}</strong>`;
      
        // Send matched group to Node backend
        await fetch(`${window.location.origin}/api/match-groups`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ group_name: groupName }),
        });

       window.location.href = "../Dashboards/groups.html";
      }else {
        resultDiv.innerHTML = `❌ Error: ${result.error}`;
      }
    } catch (error) {
      resultDiv.innerHTML = `❌ Something went wrong: ${error.message}`;
    }
  });
  
  
