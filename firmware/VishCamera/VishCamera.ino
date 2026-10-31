/* Vish snapshot camera for the AI Thinker ESP32-CAM.
 * Set a unique AP password before flashing. The video is unencrypted; use only
 * on a trusted local network. This is an experimental example, not hardened firmware.
 */
#include <WiFi.h>
#include <WebServer.h>
#include "esp_camera.h"

const char *AP_SSID = "Vish-Camera";
const char *AP_PASSWORD = "change-this-password"; // at least 8 characters
WebServer server(80);

// AI Thinker ESP32-CAM pinout
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

void headers() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
  server.sendHeader("Cache-Control", "no-store");
}
void capture() {
  camera_fb_t *frame = esp_camera_fb_get();
  headers();
  if (!frame) { server.send(500, "text/plain", "Camera capture failed"); return; }
  server.setContentLength(frame->len);
  server.send(200, "image/jpeg", "");
  WiFiClient client = server.client();
  client.write(frame->buf, frame->len);
  esp_camera_fb_return(frame);
}
void setup() {
  Serial.begin(115200);
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0; config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM; config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM; config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM; config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM; config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM; config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM; config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM; config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM; config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000; config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA; config.jpeg_quality = 12;
  config.fb_count = 1;
  if (esp_camera_init(&config) != ESP_OK) { Serial.println("Camera init failed"); return; }
  WiFi.mode(WIFI_AP);
  if (!WiFi.softAP(AP_SSID, AP_PASSWORD)) { Serial.println("Wi-Fi AP failed"); return; }
  server.on("/capture", HTTP_GET, capture);
  server.on("/capture", HTTP_OPTIONS, []() { headers(); server.send(204); });
  server.on("/", HTTP_GET, []() { server.send(200, "text/plain", "Vish camera ready: /capture"); });
  server.begin();
  Serial.print("Camera snapshot: http://"); Serial.print(WiFi.softAPIP()); Serial.println("/capture");
}
void loop() { server.handleClient(); }
