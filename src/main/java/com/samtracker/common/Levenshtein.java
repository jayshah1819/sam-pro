package com.samtracker.common;

public final class Levenshtein {

    private Levenshtein() {
    }

    public static int distance(String a, String b) {
        int m = a.length(), n = b.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 0; i <= m; i++)
            dp[i][0] = i;
        for (int j = 0; j <= n; j++)
            dp[0][j] = j;
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (a.charAt(i - 1) == b.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], Math.min(dp[i - 1][j], dp[i][j - 1]));
                }
            }
        }
        return dp[m][n];
    }

    /** Returns [0,1] where 1.0 = identical. */
    public static double similarity(String a, String b) {
        if (a.isEmpty() && b.isEmpty())
            return 1.0;
        return 1.0 - (double) distance(a, b) / Math.max(a.length(), b.length());
    }
}
