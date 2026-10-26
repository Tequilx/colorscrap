import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useEntriesStore } from "@/stores/entries";
import { installFavicon } from "@/lib/brand";
import "./fonts";
import "./assets/app.css";

installFavicon();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// โหลด session และโปรไฟล์ก่อน mount จะได้ไม่มีหน้าใดวาบก่อนรู้ว่าต้อง login หรือไป hello/cover
const start = async () => {
  const auth = useAuthStore();
  try {
    await auth.init();
    if (auth.user) await Promise.all([useProfileStore().loadRemote(), useEntriesStore().load()]);
  } catch (error) {
    console.error("เริ่มแอปไม่สำเร็จ:", error);
  }
  app.mount("#app");
};
start();
