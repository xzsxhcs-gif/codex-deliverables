package com.launchguard.guard

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ForegroundSessionTest {
    private val session = ForegroundSession()
    private val rules = setOf("first", "second")

    @Test
    fun firstVisitRequiresConfirmationAndDuplicateEventsDoNotReopen() {
        session.observe("first")
        assertEquals("first", session.pending(rules))
        assertTrue(session.confirm("first"))
        session.observe("first")
        assertNull(session.pending(rules))
        assertFalse(session.confirm("first"))
    }

    @Test
    fun leavingForHomeOrSettingsRequiresConfirmationAgain() {
        for (destination in listOf("home", "wifi-settings")) {
            session.observe("first")
            assertTrue(session.confirm("first"))
            session.observe(destination)
            assertNull(session.pending(rules))
            session.observe("first")
            assertEquals("first", session.pending(rules))
        }
    }

    @Test
    fun switchingBetweenProtectedAppsDoesNotCarryApproval() {
        session.observe("first")
        assertTrue(session.confirm("first"))
        session.observe("second")
        assertFalse(session.confirm("first"))
        assertEquals("second", session.pending(rules))
        session.observe("first")
        assertEquals("first", session.pending(rules))
    }

    @Test
    fun removingARuleDismissesPendingConfirmation() {
        session.observe("first")
        assertEquals("first", session.pending(rules))
        assertNull(session.pending(setOf("second")))
    }

    @Test
    fun lockOrServiceRestartClearsExistingApproval() {
        session.observe("first")
        assertTrue(session.confirm("first"))
        session.reset()
        assertNull(session.pending(rules))
        session.observe("first")
        assertEquals("first", session.pending(rules))
    }
}
