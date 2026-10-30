import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.core.LauncherFactory;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import static org.junit.platform.engine.discovery.DiscoverySelectors.selectClass;

/** Trusted image entrypoint. Application classes are never loaded by the host. */
public final class ResearchJUnitRunner {
    private static final class Capture extends ByteArrayOutputStream {
        @Override public synchronized void write(int value) { if (count < 100000) super.write(value); }
        @Override public synchronized void write(byte[] value, int offset, int length) {
            super.write(value, offset, Math.min(length, Math.max(0, 100000-count)));
        }
        String value() { return toString(StandardCharsets.UTF_8); }
    }
    private static String json(String value) {
        StringBuilder out = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') out.append('\\').append(c);
            else if (c < 32) out.append(String.format("\\u%04x", (int)c));
            else out.append(c);
        }
        return out.append('"').toString();
    }
    private static String row(String name, String status, String observed) {
        return "{\"test_name\":"+json(name)+",\"status\":"+json(status)+",\"observed\":"+json(observed.substring(0, Math.min(15000, observed.length())))+"}";
    }
    public static void main(String[] args) {
        PrintStream report = System.out;
        Capture stdout = new Capture(), stderr = new Capture();
        System.setOut(new PrintStream(stdout, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(stderr, true, StandardCharsets.UTF_8));
        List<String> results = new ArrayList<>(), containers = new ArrayList<>();
        try {
            var listener = new TestExecutionListener() {
                @Override public void executionSkipped(TestIdentifier id, String reason) {
                    if (results.size() < 100 && (id.isTest() || id.isContainer())) results.add(row(id.getDisplayName(), "skipped", reason));
                }
                @Override public void executionFinished(TestIdentifier id, TestExecutionResult result) {
                    var error = result.getThrowable().orElse(null);
                    String status = result.getStatus() == TestExecutionResult.Status.SUCCESSFUL ? "passed"
                        : result.getStatus() == TestExecutionResult.Status.ABORTED ? "skipped"
                        : error instanceof AssertionError ? "failed" : "test_error";
                    String observed = error == null ? "JUnit completed without failure." : error.toString();
                    if (id.isTest() && results.size() < 100) results.add(row(id.getDisplayName(), status, observed));
                    else if (!"passed".equals(status) && containers.size() < 20) containers.add(row(id.getDisplayName(), status, observed));
                }
            };
            LauncherFactory.create().execute(LauncherDiscoveryRequestBuilder.request().selectors(selectClass(args[0])).build(), listener);
            results.addAll(containers);
            if (results.isEmpty()) results.add(row(args[0], "inconclusive", "No JUnit test executed."));
        } catch (Throwable error) {
            results.add(row(args[0], "test_error", error.toString()));
        }
        report.print("{\"tests\":["+String.join(",", results)+"],\"stdout\":"+json(stdout.value())+",\"stderr\":"+json(stderr.value())+"}");
    }
}
