import "server-only";
import {
  Circle,
  Defs,
  Document,
  LinearGradient,
  Page,
  Polygon,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

const INK = "#1b1440";
const MUTED = "#6b6890";
const BRAND = "#6d4aff";
const BRAND2 = "#c045ff";
const BRAND3 = "#ff7ab6";
const ACCENT = "#ffb547";

// A4 landscape in points
const W = 842;
const H = 595;

const s = StyleSheet.create({
  page: { backgroundColor: "#ffffff", fontFamily: "Helvetica", color: INK },
  bg: { position: "absolute", top: 0, left: 0 },
  body: { position: "absolute", top: 70, left: 90, right: 90, bottom: 60, alignItems: "center" },
  brand: { fontSize: 11, letterSpacing: 4, color: BRAND, fontFamily: "Helvetica-Bold" },
  title: { marginTop: 18, fontSize: 38, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  subtitle: { marginTop: 4, fontSize: 13, letterSpacing: 6, color: MUTED },
  lead: { marginTop: 34, fontSize: 13, color: MUTED },
  name: { marginTop: 10, fontSize: 34, fontFamily: "Helvetica-Bold", color: BRAND },
  rule: { marginTop: 8, width: 360, height: 2, backgroundColor: "#ece8ff" },
  course: { marginTop: 10, fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "center", maxWidth: 560 },
  meta: { marginTop: 12, fontSize: 12, color: MUTED },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  footCol: { width: 200 },
  footLabel: { fontSize: 9, color: MUTED, letterSpacing: 1 },
  footValue: { marginTop: 3, fontSize: 11, fontFamily: "Helvetica-Bold" },
  sigLine: { height: 1, backgroundColor: "#d9d5ee", marginBottom: 6 },
});

function star(cx: number, cy: number, outer: number, inner: number, points = 5) {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return out.join(" ");
}

export type CertificateData = {
  appName: string;
  learnerName: string;
  courseTitle: string;
  score: number;
  /** Signed policy acknowledgements in the certifying attempt. */
  acknowledgements?: number;
  issuedOn: string;
  number: string;
};

function CertificateDoc(d: CertificateData) {
  return (
    <Document title={`${d.courseTitle} certificate`} author={d.appName} subject={`Certificate for ${d.learnerName}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Svg style={s.bg} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <LinearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={BRAND} />
              <Stop offset="0.55" stopColor={BRAND2} />
              <Stop offset="1" stopColor={BRAND3} />
            </LinearGradient>
            <LinearGradient id="seal" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ACCENT} />
              <Stop offset="1" stopColor={BRAND3} />
            </LinearGradient>
          </Defs>
          {/* soft corner blobs */}
          <Circle cx={0} cy={0} r={170} fill={BRAND} fillOpacity={0.07} />
          <Circle cx={W} cy={H} r={200} fill={BRAND3} fillOpacity={0.08} />
          <Circle cx={W - 60} cy={40} r={70} fill={ACCENT} fillOpacity={0.08} />
          {/* gradient frame */}
          <Rect x={22} y={22} width={W - 44} height={H - 44} rx={18} fill="none" stroke="url(#frame)" strokeWidth={10} />
          <Rect x={40} y={40} width={W - 80} height={H - 80} rx={10} fill="none" stroke="#e7e2ff" strokeWidth={1} />
          {/* seal */}
          <Circle cx={W / 2} cy={H - 98} r={38} fill="url(#seal)" />
          <Circle cx={W / 2} cy={H - 98} r={30} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeOpacity={0.9} />
          <Polygon points={star(W / 2, H - 98, 17, 7.5)} fill="#ffffff" />
        </Svg>

        <View style={s.body}>
          <Text style={s.brand}>{d.appName.toUpperCase()}</Text>
          <Text style={s.title}>Certificate</Text>
          <Text style={s.subtitle}>OF COMPLETION</Text>
          <Text style={s.lead}>This certifies that</Text>
          <Text style={s.name}>{d.learnerName}</Text>
          <View style={s.rule} />
          <Text style={s.lead}>has successfully completed</Text>
          <Text style={s.course}>{d.courseTitle}</Text>
          <Text style={s.meta}>
            with a score of {d.score}% · {d.issuedOn}
          </Text>
          {!!d.acknowledgements && (
            <Text style={s.meta}>
              including {d.acknowledgements} signed policy {d.acknowledgements === 1 ? "acknowledgement" : "acknowledgements"}
            </Text>
          )}

          <View style={s.footer}>
            <View style={s.footCol}>
              <Text style={s.footLabel}>CERTIFICATE NO.</Text>
              <Text style={s.footValue}>{d.number}</Text>
            </View>
            <View style={[s.footCol, { alignItems: "flex-end" }]}>
              <View style={[s.sigLine, { width: 200 }]} />
              <Text style={s.footLabel}>ISSUED BY</Text>
              <Text style={s.footValue}>{d.appName}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function renderCertificate(d: CertificateData) {
  return renderToBuffer(<CertificateDoc {...d} />);
}
