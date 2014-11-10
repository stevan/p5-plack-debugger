package Plack::Test::MockHTTP::WithCleanupHandlers;

# ABSTRACT: HTTP Mocking to support psgix.cleanup

use strict;
use warnings;

use Try::Tiny;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Test::MockHTTP';
 
sub request {
    my ($self, $req) = @_;

    # NOTE:
    # this shouldn't require copy/pasting from
    # the superclass, but the code is so small
    # that refactoring to methods for subclassing
    # is equally as silly as copy/pasting, so 
    # ... meh
    # - SL
 
    # Start Copy/Paste from Plack::Test::MockHTTP
    $req->uri->scheme('http')    unless defined $req->uri->scheme;
    $req->uri->host('localhost') unless defined $req->uri->host;
    my $env  = $req->to_psgi;
    # End Copy/Paste from Plack::Test::MockHTTP

    # From the PSGIx spec ...
    #   psgix.cleanup - A boolean flag indicating whether a PSGI 
    #   server supports cleanup handlers. Absence of the key assumes 
    #   false (i.e. unsupported). 
    # so we do it here.
    $env->{'psgix.cleanup'} = 1;

    # From the PSGIx spec ...
    #   psgix.cleanup.handlers - Array reference to stack callback 
    #   handlers. This reference MUST be initialized as an empty 
    #   array reference by the servers. 
    # so we do it here.
    $env->{'psgix.cleanup.handlers'} = [];

    # Start Copy/Paste from Plack::Test::MockHTTP (again)
    my $resp = try {
        HTTP::Response->from_psgi( $self->{'app'}->( $env ) );
    } catch {
        HTTP::Response->from_psgi( [ 500, [ 'Content-Type' => 'text/plain' ], [ $_ ] ] );
    };
    $resp->request($req);
    # End Copy/Paste from Plack::Test::MockHTTP (again)

    # Run the cleanup handlers after the app has 
    # been fully run and the response has been 
    # finalized/completed.
    foreach my $handler ( @{ $env->{'psgix.cleanup.handlers'} } ) {
        try { $handler->( $env ) };
    }   

    return $resp;
}


1;

__END__

=head1 DESCRIPTION

This is just a simple subclass of the L<Plack::Test::MockHTTP> 
to add support for the C<psgix.cleanup.handlers> PSGI extension.

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.

