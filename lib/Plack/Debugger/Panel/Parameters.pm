package Plack::Debugger::Panel::Parameters;

# ABSTRACT: Debug panel for inspecting HTTP request parameters

use strict;
use warnings;

use Plack::Request;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Request Parameters';
    $args{'formatter'} ||= 'ordered_keys_with_nested_data';

    $args{'after'} = sub {
        my $self = shift;
        my $r    = Plack::Request->new( shift );
        $self->set_result([
            'Query String' => $r->query_parameters->as_hashref_mixed,
            'Cookies'      => $r->cookies,
            'Headers'      => { map { $_ => $r->headers->header( $_ ) } $r->headers->header_field_names },
            'Body Content' => $r->body_parameters->as_hashref_mixed,
            ($r->env->{'psgix.session'} 
                ? ('Session' => $r->env->{'psgix.session'})
                : ()),
        ]);
    };

    $class->SUPER::new( \%args );
}


1;

__END__

=pod

=head1 DESCRIPTION

This is a L<Plack::Debugger::Panel> subclass that will display the 
various parameters of the given PSGI request. It will display the 
following; GET query parameters, request cookies, request headers 
and POST parameters. If there is a C<psgix.session>, it will display
that as well.

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.

=cut