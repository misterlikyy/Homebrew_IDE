// Example sketch for Uno Bench.
// Talks to the app using simple text lines:
//   STEP:<number>:<title>:<description>   -> shows in "What the code is doing"
//   VAL:<name>:<number>                   -> shows in "Live values"
// The app can send back: L1 (LED on), L0 (LED off), AUTO (LED follows sensor).

const int SENSOR_PIN = A0;
const int LED_PIN = 13;
const int THRESHOLD = 500;
const int STEP_DELAY = 800;   // slows each step so you can watch it. Set to 0 for full speed.

bool manual = false;
bool ledOn = false;

void step(int id, const char* title, const char* desc) {
  Serial.print("STEP:");
  Serial.print(id);
  Serial.print(":");
  Serial.print(title);
  Serial.print(":");
  Serial.println(desc);
  delay(STEP_DELAY);
}

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  step(0, "Starting up", "Serial opened at 9600 baud and pin 13 set as output.");
}

void loop() {
  step(1, "Check for commands", "Looking for a command from the computer.");
  while (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c == "L1")        { manual = true;  ledOn = true; }
    else if (c == "L0")   { manual = true;  ledOn = false; }
    else if (c == "AUTO") { manual = false; }
    Serial.print("Got command: ");
    Serial.println(c);
  }

  step(2, "Read sensor", "Reading analog pin A0 (0 to 1023).");
  int v = analogRead(SENSOR_PIN);
  Serial.print("VAL:sensor:");
  Serial.println(v);

  step(3, "Decide", manual ? "Manual mode: ignoring the sensor."
                           : "Comparing the reading with the threshold of 500.");
  if (!manual) ledOn = (v > THRESHOLD);

  step(4, "Update LED", ledOn ? "Setting pin 13 HIGH (LED on)." : "Setting pin 13 LOW (LED off).");
  digitalWrite(LED_PIN, ledOn ? HIGH : LOW);

  step(5, "Wait", "Pausing before the next loop.");
  delay(200);
}
