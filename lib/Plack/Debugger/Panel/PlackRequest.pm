package Plack::Debugger::Panel::PlackRequest;

use strict;
use warnings;

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Plack Request';
    $args{'formatter'} ||= 'ordered_key_value_pairs';

    $args{'before'} = sub {
        my ($self, $env) = @_;
        $self->set_result([ 
            map { 
                my $value = $env->{ $_ };
                if ( ref $value ) {
                    # NOTE:
                    # break down refs in a sane way, 
                    # but assume that nothing nests 
                    # beyond one level, this can be 
                    # improved later on if need be
                    # with a simple visitor closure.
                    # - SL
                    if ( ref $value eq 'ARRAY' ) {
                        $value = [ map { ($_ . '') } @$value ];
                    } 
                    elsif ( ref $value eq 'HASH' ) {
                        $value = { map { $_ => ($value->{ $_ } . '') } keys %$value };
                    }
                    else {
                        $value .= '';
                    }
                } 
                else {
                    $value .= '';
                }
                ($_ => $value);
            } sort keys %$env # sorting keys creates predictable ordering ...
        ]);
    };

    $class->SUPER::new( \%args );
}

1;

__END__

=pod

=head1 NAME

Plack::Debugger::Panel::PlackRequest - Debug panel for inspecting the Plack $env

=head1 DESCRIPTION

=head1 ACKNOWLEDGEMENTS

Thanks to Booking.com for sponsoring the writing of this module.

=cut

